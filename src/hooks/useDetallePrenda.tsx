import { useSQLiteContext } from "expo-sqlite";
import { useAppStore } from "../store/useAppStore";
import { DetallePrendaService } from "../services/DetallePrendaService";
import { DetallePrenda } from "../types";

export const useDetallePrenda = () => {
    const db = useSQLiteContext();
    const { 
        detallesPrenda, 
        selectedPrendas,
        addDetallePrendaToState, 
        updateDetallePrendaInState, 
        removeDetallesPrendaFromState,
        setDetallesPrenda 
    } = useAppStore();

    const fetchDetalles = async () => {
        const data = await DetallePrendaService.getAllDetalles(db);
        setDetallesPrenda(data);
    };

    const addDetalle = async (detalle: DetallePrenda) => {
        const result = await DetallePrendaService.addDetallePrenda(db, detalle, detalle.detalleId);
        if (result.success) {
            addDetallePrendaToState(detalle);
        }
        return result;
    };

    const toggleStatus = async (id: string) => {
        const target = detallesPrenda.find(d => d.id === id);
        if (!target) return;

        const newStatus = target.estado === 1 ? 0 : 1;
        
        const previousStatus = target.estado;
        updateDetallePrendaInState(id, { estado: newStatus as 1 | 0 });

        const result = await DetallePrendaService.updateDetallePrendaStatus(db, id, newStatus);
        
        if (!result.success) {
            updateDetallePrendaInState(id, { estado: previousStatus as 1 | 0 });
        }
    };

    const deleteSelected = async () => {
        if (selectedPrendas.length === 0) return;

        const result = await DetallePrendaService.deleteDetallesPrenda(db, selectedPrendas);
        if (result.success) {
            removeDetallesPrendaFromState(selectedPrendas);
        }
        return result;
    };

    return { 
        detallesPrenda, 
        selectedPrendas,
        fetchDetalles, 
        addDetalle, 
        toggleStatus,
        deleteSelected
    };
}
