import { useEffect, useState } from "react";

export type AppSection = "home" | "availability" | "purchase" | "more";

const sectionIds: Array<{ id: string; section: AppSection }> = [
  { id: "disponibilidad", section: "availability" },
  { id: "compra", section: "purchase" },
  { id: "more", section: "more" },
];

export function useActiveSection() {
  const [activeSection, setActiveSection] = useState<AppSection>("home");

  useEffect(() => {
    const updateFromScroll = () => {
      if (window.scrollY < 260) {
        setActiveSection("home");
        return;
      }

      const current = sectionIds
        .map(({ id, section }) => ({
          section,
          top: document.getElementById(id)?.getBoundingClientRect().top,
        }))
        .filter(
          (candidate): candidate is { section: AppSection; top: number } =>
            typeof candidate.top === "number",
        )
        .filter((candidate) => candidate.top <= window.innerHeight * 0.42)
        .at(-1);

      setActiveSection(current?.section ?? "availability");
    };

    updateFromScroll();
    window.addEventListener("scroll", updateFromScroll, { passive: true });
    window.addEventListener("resize", updateFromScroll);
    return () => {
      window.removeEventListener("scroll", updateFromScroll);
      window.removeEventListener("resize", updateFromScroll);
    };
  }, []);

  return activeSection;
}
