import { useSQLiteContext } from "expo-sqlite";
import { useAppStore } from "../../store/useAppStore";
import { GarmentService } from "../../services";
import { Garment } from "../../types";

export const useGarment = () => {
  const db = useSQLiteContext();
  const garments = useAppStore(state => state.garments);
  const addGarmentToState = useAppStore(state => state.addGarmentToState);
  const updateGarmentInState = useAppStore(state => state.updateGarmentInState);
  const setGarments = useAppStore(state => state.setGarments);

  const fetchGarments = async (boxId: string) => {
    const data = await GarmentService.getAllGarmentsByBox(db, boxId);
    setGarments(data);
  };

  const addGarment = async (garment: Garment) => {
    const result = await GarmentService.addGarment(db, garment);
    if (result.success) {
      addGarmentToState(garment);
    }
    return result;
  };

  const toggleStatus = async (id: string) => {
    const target = garments.find(g => g.id === id);
    if (!target) return;

    const newStatus = (target.status === 1 ? 0 : 1) as (0 | 1);
    const previousStatus = target.status;
    updateGarmentInState(id, { status: newStatus });

    const result = await GarmentService.updateGarmentStatus(db, id, newStatus);
    if (!result.success) {
      updateGarmentInState(id, { status: previousStatus });
    }
  };

  return {
    garments,
    fetchGarments,
    addGarment,
    toggleStatus,
  };
};

export default useGarment;
