import bootstrap from "./bootstrap";
import config from "./config";
import controllers from "./controllers";
import register from "./register";
import services from "./services";

export default {
  controllers,
  register,
  bootstrap,
  config,
  services,
  // Needed if you want to create routes in the plugin extensions folder.
  routes: {},
};
