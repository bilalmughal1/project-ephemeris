import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Map from "./components/Map";
import FilterPanel from "./components/FilterPanel";
import SearchPanel from "./components/SearchPanel";
import AccessesTable from "./components/AccessesTable";
import ModeSwitch from "./components/ModeSwitch";
import { useFiltersStore } from "./store/filtersStore";

const queryClient = new QueryClient();

function App() {
  const mode = useFiltersStore((state) => state.mode);

  return (
    <QueryClientProvider client={queryClient}>
      <Map />
      <ModeSwitch />
      {mode === "browse" ? (
        <FilterPanel />
      ) : (
        <>
          <SearchPanel />
          <AccessesTable />
        </>
      )}
    </QueryClientProvider>
  );
}

export default App;
