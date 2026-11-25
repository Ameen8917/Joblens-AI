import "dotenv/config";
import { createApp } from "./app";
import { connectDB } from "./config/database";
import { initGemini } from "./config/gemini";
import { initDemoCache } from "./config/demoCache";

const PORT = parseInt(process.env.PORT || "5000", 10);

const start = async (): Promise<void> => {
  await connectDB();
  initGemini();
  initDemoCache();
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`\n🚀 JobLens API running on http://localhost:${PORT}`);
    console.log(`📋 Health: http://localhost:${PORT}/health\n`);
  });
};

process.on("unhandledRejection", (reason) => { console.error("Unhandled Rejection:", reason); process.exit(1); });

start();
