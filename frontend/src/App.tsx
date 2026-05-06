import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";
import { Preview } from "./pages/Preview";
import { Status } from "./pages/Status";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/jobs/:jobId" element={<Status />} />
        <Route path="/jobs/:jobId/preview" element={<Preview />} />
      </Routes>
    </BrowserRouter>
  );
}
