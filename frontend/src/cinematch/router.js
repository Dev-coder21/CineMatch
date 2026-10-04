import { useEffect, useState } from "react";

/* Tiny hash router: #/broadcast, #/broadcast/app?viewer=42, #/ticket ... */
function read() {
  const hash = window.location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = hash.split("?");
  return { path, params: new URLSearchParams(query) };
}

export function useRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function go(path, params) {
  const q = params ? `?${new URLSearchParams(params)}` : "";
  window.location.hash = `${path}${q}`;
}
