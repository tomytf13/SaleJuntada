import { Suspense, lazy, useEffect } from "react";
import { Route, Routes, useLocation, useParams } from "react-router-dom";
import { GatheringSkeleton } from "./routes/GatheringSkeleton";

const LandingPage = lazy(() => import("./routes/LandingPage"));
const GatheringPage = lazy(() => import("./routes/GatheringPage"));
const NotFoundPage = lazy(() => import("./routes/NotFoundPage"));

function GatheringRoute() {
  const { slug } = useParams();
  return <GatheringPage key={slug} />;
}

/**
 * Shell de routing. No decide qué es landing ni qué es juntada — eso lo
 * decide `<Routes>`. Cada ruta es su propia página, cargada por separado
 * para que `/j/:slug` no descargue el JS de la landing ni al revés.
 */
export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Only the public landing belongs in search results, never invitation pages.
    const isHome = pathname === "/";
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.append(robots);
    }
    robots.content = isHome ? "index, follow" : "noindex, nofollow";
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!isHome) canonical?.remove();
    else if (!canonical) {
      const link = document.createElement("link");
      link.rel = "canonical";
      link.href = "https://salejuntada.com.ar/";
      document.head.append(link);
    }
  }, [pathname]);
  return (
    <Suspense fallback={<GatheringSkeleton />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/j/:slug/*" element={<GatheringRoute />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
