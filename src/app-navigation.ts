export type AppView = "play" | "home" | "guide";

export function readAppView(search: string, pathname = ""): AppView {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  if (normalizedPath === "/how-to-play") return "guide";
  const requested = new URLSearchParams(search).get("view");
  if (requested === "home" || requested === "lobby") return "home";
  if (requested === "guide" || requested === "how-to-play" || requested === "rules") return "guide";
  return "play";
}

export function urlForAppView(href: string, view: AppView): string {
  const url = new URL(href);
  if (view === "guide") {
    url.pathname = "/how-to-play";
    url.searchParams.delete("view");
  } else {
    if (url.pathname.replace(/\/+$/, "") === "/how-to-play") url.pathname = "/";
    if (view === "play") url.searchParams.delete("view");
    else url.searchParams.set("view", view);
  }
  url.hash = "";
  return `${url.pathname}${url.search}`;
}
