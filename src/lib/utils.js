import clsx from "clsx";

export function cn(...inputs) {
  return clsx(inputs);
}

export function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function wait(ms = 120) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
