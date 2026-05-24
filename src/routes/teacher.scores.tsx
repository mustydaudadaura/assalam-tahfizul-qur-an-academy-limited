import { createFileRoute } from "@tanstack/react-router";
import { ResultsPage } from "./admin.results";

export const Route = createFileRoute("/teacher/scores")({ component: ResultsPage });
