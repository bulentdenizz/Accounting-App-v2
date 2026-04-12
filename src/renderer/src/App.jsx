import Versions from './components/Versions'
import electronLogo from './assets/electron.svg'

function App() {
  const ipcHandle = () => window.electron.ipcRenderer.send('ping')

  return (
    <>
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white">
        <div className="p-10 bg-blue-500 rounded-2xl shadow-2xl transform hover:scale-110 transition-transform cursor-pointer">
          <h1 className="text-4xl font-extrabold tracking-tight">
            Tailwind Test Paneli
          </h1>
          <p className="mt-4 text-lg text-blue-100">
            Eğer bu kutu mavi ve arka plan koyu griyse her şey yolunda!
          </p>
        </div>
      </div>
    </>
  )
}

export default App
