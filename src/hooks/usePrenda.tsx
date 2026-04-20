import { useSQLiteContext } from "expo-sqlite";
import { useAppStore } from "../store/useAppStore";
import { PrendaService } from "../services/PrendaService";
import { Prenda } from "../types";

export const usePrenda = () => {
    const db = useSQLiteContext();
    const { 
        prendas, 
        addPrendaToState, 
        updatePrendaInState, 
        setPrendas 
    } = useAppStore();

    const fetchPrendas = async (cajaId: string) => {
        const data = await PrendaService.getAllPrendasByCaja(db, cajaId);
        setPrendas(data);
    };

    const addPrenda = async (prenda: Prenda) => {
        const result = await PrendaService.addPrenda(db, prenda);
        if (result.success) {
            addPrendaToState(prenda);
        }
        return result;
    };

    const toggleStatus = async (id: string) => {
        const target = prendas.find(p => p.id === id);
        if (!target) return;

        const newStatus = target.estado === 1 ? 0 : 1;
        
        // Optimistic update
        const previousStatus = target.estado;
        updatePrendaInState(id, { estado: newStatus as 1 | 0 });

        const result = await PrendaService.updatePrendaStatus(db, id, newStatus);
        
        if (!result.success) {
            // Rollback on failure
            updatePrendaInState(id, { estado: previousStatus as 1 | 0 });
        }
    };

    return { 
        prendas, 
        fetchPrendas, 
        addPrenda, 
        toggleStatus 
    };
}
