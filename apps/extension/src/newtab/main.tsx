import { createRoot } from "react-dom/client";
import { ToastProvider } from "@tablign/ui";
import { NewTab } from "./NewTab";

createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <NewTab />
  </ToastProvider>,
);
