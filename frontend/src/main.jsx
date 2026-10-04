import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useRoute } from "./cinematch/router.js";
import HomePage from "./app/HomePage.jsx";
import ConsolePage from "./app/ConsolePage.jsx";
import "./app/app.css";
import "./base.css";

/* #/                    intro, then the home page (everything about the project)
   #/console?viewer=42   find your next ten films, with the picks on the same page
   Hash routes keep it working on static hosting such as GitHub Pages. */
function App() {
  const { path, params } = useRoute();
  const page = ["/console", "/picks", "/app"].includes(path) ? "console" : "home";
  useEffect(() => { window.scrollTo(0, 0); }, [page]);
  return page === "console" ? <ConsolePage params={params} /> : <HomePage />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
