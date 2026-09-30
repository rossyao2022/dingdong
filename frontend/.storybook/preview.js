import "../styles.css";
import "../playful.css";
import "../fingerprint.css";
import "../exploration-v4.css";
import "../talents.css";
import "../readability.css";
import "../client.css";

export default {
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "家长端浅灰" },
    viewport: {
      viewports: {
        narrow: {
          name: "窄屏 320",
          styles: { width: "320px", height: "700px" },
        },
        phone: {
          name: "手机 390",
          styles: { width: "390px", height: "844px" },
        },
        widePhone: {
          name: "大屏手机 430",
          styles: { width: "430px", height: "932px" },
        },
      },
    },
  },
};
