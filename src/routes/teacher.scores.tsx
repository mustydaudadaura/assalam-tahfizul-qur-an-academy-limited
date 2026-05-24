import { createFileRoute } from "@tanstack/react-router";
export { Route as default } from "./admin.results";
export const Route = createFileRoute("/teacher/scores")({
  component: () => {
    const Comp = require("./admin.results");
    return <Comp.Route.options.component />;
  },
});
