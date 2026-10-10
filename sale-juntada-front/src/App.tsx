import { Suspense, lazy } from "react";
import { Route, Routes, useParams } from "react-router-dom";
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
