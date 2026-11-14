import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// WebGL: use ANGLE on desktop; scripts/render.mjs auto-switches to swangle on headless/Termux.
Config.setChromiumOpenGlRenderer("angle");
