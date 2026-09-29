export default {
  framework: "@storybook/html-vite",
  stories: ["../stories/**/*.stories.js"],
  addons: ["@storybook/addon-docs"],
  staticDirs: [{ from: "../assets", to: "/assets" }],
};
