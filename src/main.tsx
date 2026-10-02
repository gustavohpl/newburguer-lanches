import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
const AdminPage = lazy(() => import('./admin'))
const AwwwardsHero = lazy(() => import('./components/awwwards/AwwwardsHero').then((m) => ({ default: m.AwwwardsHero })))
const RevealHero = lazy(() => import('./components/reveal/RevealHero').then((m) => ({ default: m.RevealHero })))
import { ConfigProvider } from './ConfigContext'
import './styles/globals.css'
import { iniciarPwa } from './pwa'

iniciarPwa()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/entrega" element={<App />} />
        <Route path="/master" element={<App />} />
        <Route path="/admin" element={<App />} />
        <Route path="/admin/:password" element={<AdminPage />} />
        <Route path="/hero3d" element={<ConfigProvider><AwwwardsHero /></ConfigProvider>} />
        <Route path="/hero-reveal" element={<ConfigProvider><RevealHero /></ConfigProvider>} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>,
)
