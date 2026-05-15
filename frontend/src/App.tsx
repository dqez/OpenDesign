import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AboutPage } from "./pages/about-page";
import { DesignMdPage } from "./pages/DesignMdPage";
import { Home } from "./pages/Home";
import { PrivacyPage } from "./pages/privacy-page";
import { Preview } from "./pages/Preview";
import { Status } from "./pages/Status";
import { TermsPage } from "./pages/terms-page";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/:brand/design-md" element={<DesignMdPage />} />
        <Route path="/jobs/:jobId" element={<Status />} />
        <Route path="/jobs/:jobId/preview" element={<Preview />} />
      </Routes>
    </BrowserRouter>
  );
}
