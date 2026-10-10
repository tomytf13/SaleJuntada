import type { Gathering } from "../services/gatheringService";
import { NavLink } from "react-router-dom";
import {
  gatheringModules,
  gatheringNavigation,
  isGatheringServiceEnabled,
} from "../utils/gatheringModules";

export function GatheringNavigation({ gathering }: { gathering: Gathering }) {
  const base = `/j/${gathering.slug}`;
  return (
    <>
      <aside className="gathering-sidebar">
        <div className="sidebar-context">
          <span className="section-kicker">TU JUNTADA</span>
          <strong>{gathering.title}</strong>
        </div>
        <nav aria-label="Secciones de la juntada">
          {[
            gatheringNavigation[0],
            ...gatheringModules.filter((module) =>
              isGatheringServiceEnabled(gathering, module.path),
            ),
            ...gatheringNavigation.slice(2),
          ].map(({ path, title, icon: Icon }) => (
            <NavLink
              key={path}
              to={`${base}${path ? `/${path}` : ""}`}
              end={!path}
            >
              <Icon size={18} aria-hidden="true" />
              {title}
            </NavLink>
          ))}
        </nav>
      </aside>
      <nav
        className="gathering-mobile-nav"
        aria-label="Navegación de la juntada"
      >
        {gatheringNavigation.map(({ path, title, icon: Icon }) => (
          <NavLink
            key={path}
            to={`${base}${path ? `/${path}` : ""}`}
            end={!path}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{title}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
