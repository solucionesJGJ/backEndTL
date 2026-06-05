import {
  sequelize,
  Garment,
  GarmentBatch,
  GarmentMovement,
  GarmentStock,
  MovementStatus,
} from "../models/index.js";

type CreateMovementInput = {
  batch_id: string;
  garment_id: string;
  from_status_id?: string | null;
  to_status_id: string;
  quantity: number;
  movement_type: string;
  created_by: string;
  notes?: string | null;
};

export async function createGarmentMovement(input: CreateMovementInput) {
  return sequelize.transaction(async (transaction) => {
    if (input.quantity <= 0) {
      throw new Error("La cantidad debe ser mayor a 0");
    }

    const batch = await GarmentBatch.findByPk(input.batch_id, {
      transaction,
    });

    if (!batch) {
      throw new Error("Lote no encontrado");
    }

    const garment = await Garment.findByPk(input.garment_id, {
      transaction,
    });

    if (!garment) {
      throw new Error("Prenda no encontrada");
    }

    if (garment.client_id !== batch.client_id) {
      throw new Error("La prenda no pertenece al cliente del lote");
    }

    const toStatus = await MovementStatus.findByPk(input.to_status_id, {
      transaction,
    });

    if (!toStatus) {
      throw new Error("Estado destino no encontrado");
    }

    if (input.from_status_id) {
      const fromStatus = await MovementStatus.findByPk(input.from_status_id, {
        transaction,
      });

      if (!fromStatus) {
        throw new Error("Estado origen no encontrado");
      }

      const fromStock = await GarmentStock.findOne({
        where: {
          client_id: garment.client_id,
          garment_id: input.garment_id,
          status_id: input.from_status_id,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!fromStock || fromStock.quantity < input.quantity) {
        throw new Error("Stock insuficiente en el estado origen");
      }

      await fromStock.update(
        {
          quantity: fromStock.quantity - input.quantity,
        },
        { transaction }
      );
    }

    const [toStock] = await GarmentStock.findOrCreate({
      where: {
        client_id: garment.client_id,
        garment_id: input.garment_id,
        status_id: input.to_status_id,
      },
      defaults: {
        client_id: garment.client_id,
        garment_id: input.garment_id,
        status_id: input.to_status_id,
        quantity: 0,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    await toStock.update(
      {
        quantity: toStock.quantity + input.quantity,
      },
      { transaction }
    );

    const movement = await GarmentMovement.create(
      {
        batch_id: input.batch_id,
        garment_id: input.garment_id,
        from_status_id: input.from_status_id || null,
        to_status_id: input.to_status_id,
        quantity: input.quantity,
        movement_type: input.movement_type,
        created_by: input.created_by,
        notes: input.notes || null,
      },
      { transaction }
    );

    return movement;
  });
}