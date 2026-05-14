import { expect, it } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";

it("renders the router shell", () => {
  const element = App();
  expect(element.type).toBe(BrowserRouter);
});
