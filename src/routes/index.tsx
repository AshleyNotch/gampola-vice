import { createFileRoute } from "@tanstack/react-router";
import { ViceCityGame } from "@/components/ViceCityGame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gampola Vice Drive — Neon Driving Game" },
      {
        name: "description",
        content:
          "Cruise the real streets of Gampola, Sri Lanka in a neon Vice City-style top-down driving game. Find Ambuluwawa Tower.",
      },
      { property: "og:title", content: "Gampola Vice Drive" },
      {
        property: "og:description",
        content: "A neon, retro-80s top-down driving game set in Gampola, Sri Lanka.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <ViceCityGame />;
}
