import { createContext, useContext, useState, useCallback } from 'react'

interface AppState {
  dataVersion: number
  refreshData: () => void
}

export const AppStateContext = createContext<AppState>({
  dataVersion: 0,
  refreshData: () => {},
})

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [dataVersion, setDataVersion] = useState(0)

  const refreshData = useCallback(() => {
    setDataVersion(v => v + 1)
  }, [])

  return (
    <AppStateContext.Provider value={{ dataVersion, refreshData }}>
      {children}
    </AppStateContext.Provider>
  )
}

export function useAppState() {
  return useContext(AppStateContext)
}
