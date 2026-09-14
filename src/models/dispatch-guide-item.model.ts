import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export class DispatchGuideItem extends Model<
  InferAttributes<DispatchGuideItem>,
  InferCreationAttributes<DispatchGuideItem>
> {
  declare id: CreationOptional<string>;

  /**
   * Guía a la que pertenece esta línea.
   */
  declare dispatch_guide_id: string;

  /**
   * Movimiento de salida asociado.
   *
   * Puede permanecer null mientras la guía
   * se prepara antes de registrar definitivamente
   * PREPARADO_DESPACHO -> EN_TRASLADO.
   */
  declare movement_id: string | null;

  /**
   * Prenda original.
   */
  declare garment_id: string;

  /**
   * Snapshot histórico.
   */
  declare garment_code: string | null;

  declare garment_description: string;

  declare quantity: number;

  declare unit_value: number;

  declare createdAt: CreationOptional<Date>;

  declare updatedAt: CreationOptional<Date>;
}

export function initDispatchGuideItemModel(
  sequelize: Sequelize,
): typeof DispatchGuideItem {
  DispatchGuideItem.init(
    {
      id: {
        type: DataTypes.UUID,

        defaultValue: DataTypes.UUIDV4,

        primaryKey: true,
      },

      dispatch_guide_id: {
        type: DataTypes.UUID,

        allowNull: false,
      },

      movement_id: {
        type: DataTypes.UUID,

        allowNull: true,
      },

      garment_id: {
        type: DataTypes.UUID,

        allowNull: false,
      },

      garment_code: {
        type: DataTypes.STRING(100),

        allowNull: true,
      },

      garment_description: {
        type: DataTypes.STRING(250),

        allowNull: false,
      },

      quantity: {
        type: DataTypes.INTEGER,

        allowNull: false,

        validate: {
          min: 1,
        },
      },

      unit_value: {
        type: DataTypes.DECIMAL(12, 2),

        allowNull: false,

        defaultValue: 0,
      },

      createdAt: {
        type: DataTypes.DATE,

        field: "created_at",
      },

      updatedAt: {
        type: DataTypes.DATE,

        field: "updated_at",
      },
    },
    {
      sequelize,

      tableName: "dispatch_guide_items",

      timestamps: true,

      underscored: true,

      indexes: [
        {
          fields: ["dispatch_guide_id"],
        },

        {
          fields: ["movement_id"],
        },

        {
          fields: ["garment_id"],
        },

        /**
         * La misma prenda sólo aparece una vez
         * dentro de una misma guía.
         *
         * El servicio agrupa su cantidad.
         */
        {
          unique: true,

          fields: ["dispatch_guide_id", "garment_id"],
        },
      ],
    },
  );

  return DispatchGuideItem;
}
