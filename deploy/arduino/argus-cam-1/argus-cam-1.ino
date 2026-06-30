/*
 * ARGUS Cam 1 — AI-Thinker ESP32-CAM (Arduino IDE)
 *
 * Board: AI Thinker ESP32-CAM, PSRAM enabled, Huge APP partition
 * Test: http://IP/capture  then  http://IP/stream  (one browser tab at a time)
 */

#include "esp_camera.h"
#include <WiFi.h>
#include "esp_http_server.h"
#include "esp_wifi.h"

// -------- EDIT WiFi --------
const char* WIFI_SSID = "Mato Extender";
const char* WIFI_PASS = "20032009";
// ---------------------------

// -------- Video quality (edit here) --------
// AI Thinker OV2640 presets (lower JPEG number = sharper, larger frames, lower FPS):
//   VGA  640x480 q10  ~10-15 FPS  <- default (best balance for ARGUS)
//   QVGA 320x240 q12  ~20-25 FPS  <- max smoothness, lower detail
//   SVGA 800x600 q10  ~5-8 FPS    <- more detail, choppier
//
// Change CAM_FRAME_SIZE + CAM_JPEG_QUALITY + STREAM_TARGET_FPS together.
#define STREAM_TARGET_FPS  12     // VGA sweet spot on WiFi; try 15 if stable
#define CAM_JPEG_QUALITY   10     // 10-12 for VGA; avoid below 10 (huge frames)
#define CAM_FRAME_SIZE     FRAMESIZE_VGA
#define CAM_FB_COUNT       2      // double-buffer — best streaming FPS with PSRAM
#define STREAM_CHUNK_SIZE  8192
// -------------------------------------------

#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

static httpd_handle_t camera_httpd = NULL;
static SemaphoreHandle_t camera_mutex = NULL;

struct frame_copy {
  uint8_t* data;
  size_t len;
};

static frame_copy copy_frame_to_ram(camera_fb_t* fb) {
  frame_copy fc = { nullptr, fb->len };
  if (!fb->len) return fc;
  fc.data = psramFound() ? (uint8_t*)ps_malloc(fb->len) : (uint8_t*)malloc(fb->len);
  if (!fc.data) fc.data = (uint8_t*)malloc(fb->len);
  if (fc.data) memcpy(fc.data, fb->buf, fb->len);
  else fc.len = 0;
  return fc;
}

static void free_frame_copy(frame_copy* fc) {
  if (fc && fc->data) {
    free(fc->data);
    fc->data = nullptr;
    fc->len = 0;
  }
}

static esp_err_t send_jpeg_chunks(httpd_req_t* req, const uint8_t* buf, size_t len) {
  esp_err_t res = ESP_OK;
  for (size_t i = 0; i < len && res == ESP_OK; i += STREAM_CHUNK_SIZE) {
    size_t chunk = len - i;
    if (chunk > STREAM_CHUNK_SIZE) chunk = STREAM_CHUNK_SIZE;
    res = httpd_resp_send_chunk(req, (const char*)buf + i, chunk);
  }
  return res;
}

// Quick grab — stream should drop frames instead of blocking the camera pipeline.
static camera_fb_t* grab_frame_quick() {
  for (int i = 0; i < 8; i++) {
    camera_fb_t* fb = esp_camera_fb_get();
    if (fb) return fb;
    vTaskDelay(10 / portTICK_PERIOD_MS);
  }
  return NULL;
}

static camera_fb_t* grab_frame() {
  for (int i = 0; i < 20; i++) {
    camera_fb_t* fb = esp_camera_fb_get();
    if (fb) return fb;
    vTaskDelay(10 / portTICK_PERIOD_MS);
  }
  return NULL;
}

static esp_err_t capture_handler(httpd_req_t* req) {
  if (xSemaphoreTake(camera_mutex, pdMS_TO_TICKS(800)) != pdTRUE) {
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  camera_fb_t* fb = grab_frame();
  if (!fb) {
    xSemaphoreGive(camera_mutex);
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  frame_copy fc = copy_frame_to_ram(fb);
  esp_camera_fb_return(fb);
  xSemaphoreGive(camera_mutex);

  if (!fc.data) {
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  esp_err_t res = httpd_resp_send(req, (const char*)fc.data, fc.len);
  free_frame_copy(&fc);
  return res;
}

static esp_err_t stream_handler(httpd_req_t* req) {
  char part_buf[128];
  static const char* STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=frame";
  static const char* STREAM_BOUNDARY = "\r\n--frame\r\n";
  static const char* STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

  esp_err_t res = httpd_resp_set_type(req, STREAM_CONTENT_TYPE);
  if (res != ESP_OK) return res;
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");

  int fail_streak = 0;
  const uint32_t frame_ms = 1000 / STREAM_TARGET_FPS;

  while (fail_streak < 5) {
    uint32_t frame_start = millis();

    // Skip this tick instead of blocking for seconds (avoids freeze-then-catch-up).
    if (xSemaphoreTake(camera_mutex, 0) != pdTRUE) {
      vTaskDelay(1);
      continue;
    }

    camera_fb_t* fb = grab_frame_quick();
    if (!fb) {
      xSemaphoreGive(camera_mutex);
      fail_streak++;
      vTaskDelay(10 / portTICK_PERIOD_MS);
      continue;
    }

    frame_copy fc = copy_frame_to_ram(fb);
    esp_camera_fb_return(fb);
    xSemaphoreGive(camera_mutex);

    if (!fc.data) {
      fail_streak++;
      continue;
    }
    fail_streak = 0;

    size_t hlen = snprintf(part_buf, sizeof(part_buf), STREAM_PART, fc.len);
    res = httpd_resp_send_chunk(req, STREAM_BOUNDARY, strlen(STREAM_BOUNDARY));
    if (res == ESP_OK) res = httpd_resp_send_chunk(req, part_buf, hlen);
    if (res == ESP_OK) res = send_jpeg_chunks(req, fc.data, fc.len);
    free_frame_copy(&fc);

    if (res != ESP_OK) break;

    uint32_t elapsed = millis() - frame_start;
    if (elapsed < frame_ms) {
      vTaskDelay(pdMS_TO_TICKS(frame_ms - elapsed));
    }
  }
  return res;
}

static esp_err_t index_handler(httpd_req_t* req) {
  const char* html =
    "<html><body style='background:#111;color:#0ff;font-family:sans-serif;text-align:center;padding:2rem'>"
    "<h1>ARGUS Cam 1</h1>"
    "<p>Open <strong>one</strong> link at a time (close other tabs first).</p>"
    "<p><a href='/capture' style='color:#0ff;font-size:1.2rem'>Snapshot /capture</a></p>"
    "<p><a href='/stream' style='color:#0ff;font-size:1.2rem'>Live /stream</a></p>"
    "<p style='color:#888;margin-top:2rem'>Home Assistant: same URLs for Generic Camera</p>"
    "</body></html>";
  httpd_resp_set_type(req, "text/html");
  return httpd_resp_send(req, html, HTTPD_RESP_USE_STRLEN);
}

static esp_err_t status_handler(httpd_req_t* req) {
  const char* msg = "ARGUS Cam 1 OK\n";
  httpd_resp_set_type(req, "text/plain");
  return httpd_resp_send(req, msg, HTTPD_RESP_USE_STRLEN);
}

void tune_camera_sensor() {
  sensor_t* s = esp_camera_sensor_get();
  if (!s) return;
  s->set_brightness(s, 1);
  s->set_contrast(s, 1);
  s->set_saturation(s, 0);
  s->set_exposure_ctrl(s, 1);
  s->set_gain_ctrl(s, 1);
  s->set_ae_level(s, 1);       // slightly brighter in dim rooms
  s->set_whitebal(s, 1);
  s->set_awb_gain(s, 1);
}

void start_camera_server() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.max_uri_handlers = 8;
  config.max_open_sockets = 4;
  config.lru_purge_enable = true;
  config.stack_size = 12288;
  config.recv_wait_timeout = 5;
  config.send_wait_timeout = 10;

  if (httpd_start(&camera_httpd, &config) == ESP_OK) {
    httpd_uri_t index_uri = { .uri = "/", .method = HTTP_GET, .handler = index_handler };
    httpd_uri_t status_uri = { .uri = "/status", .method = HTTP_GET, .handler = status_handler };
    httpd_uri_t capture_uri = { .uri = "/capture", .method = HTTP_GET, .handler = capture_handler };
    httpd_uri_t stream_uri = { .uri = "/stream", .method = HTTP_GET, .handler = stream_handler };
    httpd_register_uri_handler(camera_httpd, &index_uri);
    httpd_register_uri_handler(camera_httpd, &status_uri);
    httpd_register_uri_handler(camera_httpd, &capture_uri);
    httpd_register_uri_handler(camera_httpd, &stream_uri);
  }
}

void print_psram_info() {
  if (psramFound()) {
    Serial.printf("PSRAM: Found (%u bytes)\n", ESP.getPsramSize());
  } else {
    Serial.println("PSRAM: NOT FOUND — enable in Arduino IDE, use QVGA only");
  }
}

void camera_power_on() {
  pinMode(PWDN_GPIO_NUM, OUTPUT);
  digitalWrite(PWDN_GPIO_NUM, HIGH);
  delay(10);
  digitalWrite(PWDN_GPIO_NUM, LOW);
  delay(100);
}

bool init_camera_once(camera_config_t& config) {
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("esp_camera_init failed: 0x%x\n", err);
    return false;
  }
  return true;
}

bool init_camera() {
  camera_power_on();

  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.frame_size = psramFound() ? CAM_FRAME_SIZE : FRAMESIZE_QVGA;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode = CAMERA_GRAB_LATEST;
  config.jpeg_quality = CAM_JPEG_QUALITY;
  config.fb_count = psramFound() ? CAM_FB_COUNT : 1;
  config.fb_location = psramFound() ? CAMERA_FB_IN_PSRAM : CAMERA_FB_IN_DRAM;

  if (init_camera_once(config)) return true;

  esp_camera_deinit();
  delay(200);
  camera_power_on();
  config.xclk_freq_hz = 10000000;
  config.frame_size = FRAMESIZE_QVGA;
  config.jpeg_quality = 12;
  config.fb_location = CAMERA_FB_IN_DRAM;
  config.fb_count = 1;
  return init_camera_once(config);
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\nARGUS Cam 1 starting...");
  print_psram_info();

  camera_mutex = xSemaphoreCreateMutex();

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.printf("WiFi -> %s ", WIFI_SSID);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  esp_wifi_set_ps(WIFI_PS_NONE);
  Serial.printf("\nIP: %s\n", WiFi.localIP().toString().c_str());

  if (!init_camera()) {
    Serial.println("Camera init FAILED — check ribbon / 5V / board setting");
    return;
  }
  tune_camera_sensor();
  sensor_t* s = esp_camera_sensor_get();
  framesize_t fs = s ? s->status.framesize : FRAMESIZE_QVGA;
  const char* res =
    fs == FRAMESIZE_UXGA ? "1600x1200" :
    fs == FRAMESIZE_SVGA ? "800x600" :
    fs == FRAMESIZE_VGA ? "640x480" : "320x240";
  Serial.printf("Camera OK — %s, JPEG q=%d, fb=%d, stream cap ~%d FPS\n",
                res, CAM_JPEG_QUALITY, psramFound() ? CAM_FB_COUNT : 1, STREAM_TARGET_FPS);

  start_camera_server();
  Serial.println("Ready:");
  Serial.println("  http://" + WiFi.localIP().toString() + "/status");
  Serial.println("  http://" + WiFi.localIP().toString() + "/capture");
  Serial.println("  http://" + WiFi.localIP().toString() + "/stream");
  Serial.println("Close extra tabs — use ONE stream URL at a time (no HA snapshot polling while testing)");
}

void loop() {
  delay(10000);
}
