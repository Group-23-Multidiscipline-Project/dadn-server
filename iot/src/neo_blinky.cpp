#include <neo_blinky.h>

void neo_blinky(void *pv) {
    Adafruit_NeoPixel strip(LED_COUNT, NEO_PIN, NEO_GRB + NEO_KHZ800);
    strip.begin();

    strip.clear();
    strip.show();

    while (1)
    {
        /* code */
        strip.setPixelColor(0, strip.Color(127, 127, 0));
        strip.show();

        vTaskDelay(1000);

        strip.setPixelColor(0, strip.Color(0, 0, 0));
        strip.show();

        vTaskDelay(1000);
    }
    
}