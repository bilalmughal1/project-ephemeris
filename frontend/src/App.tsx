import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Map from "./components/Map";
import FilterPanel from "./components/FilterPanel";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Map />
      <FilterPanel />
    </QueryClientProvider>
  );
}

export default App;
