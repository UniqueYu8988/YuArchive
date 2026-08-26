import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import ArchiveStudioShell from './components/ArchiveStudioShell'

const MusicStudio = lazy(() => import('./pages/ArchiveStudioPage'))
const TextsStudio = lazy(() => import('./pages/ArchiveStudioTextsPage'))
const VisionsStudio = lazy(() => import('./pages/ArchiveStudioVisionsPage'))
const GamesStudio = lazy(() => import('./pages/ArchiveStudioGamesPage'))
const HomepageStudio = lazy(() => import('./pages/ArchiveStudioHomepagePage'))

function StudioLoading() {
  return <div className="studio-route-loading">正在打开...</div>
}

export default function StudioApp() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light')
    document.documentElement.classList.add('archive-studio-document')
    return () => document.documentElement.classList.remove('archive-studio-document')
  }, [])

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ArchiveStudioShell>
        <Suspense fallback={<StudioLoading />}>
          <Routes>
            <Route path="/studio" element={<MusicStudio />} />
            <Route path="/studio/texts" element={<TextsStudio />} />
            <Route path="/studio/visions" element={<VisionsStudio />} />
            <Route path="/studio/games" element={<GamesStudio />} />
            <Route path="/studio/home" element={<HomepageStudio />} />
            <Route path="*" element={<Navigate to="/studio" replace />} />
          </Routes>
        </Suspense>
      </ArchiveStudioShell>
    </HashRouter>
  )
}
