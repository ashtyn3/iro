import { createSignal, onMount } from "solid-js";
import { Title } from "@solidjs/meta";
import DocsLayout from "~/components/docs/DocsLayout";
import "~/styles/docs.css";

export default function Docs() {
  const [activeSection, setActiveSection] = createSignal("overview");

  onMount(() => {
    // Handle hash changes for navigation
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash) {
        setActiveSection(hash);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange(); // Check initial hash

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  });

  return (
    <>
      <Title>Game Engine Documentation</Title>
      <DocsLayout activeSection={activeSection()} setActiveSection={setActiveSection} />
    </>
  );
}