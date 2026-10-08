import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export class DispatchGuide extends Model<
  InferAttributes<DispatchGuide>,
  InferCreationAttributes<DispatchGuide>
> {
  declare id: CreationOptional<string>;

  /**
   * =====================================================
   * LOTE / CLIENTE
   * =====================================================
   *
   * Una guía representa un despacho completo
   * de un lote.
   */
  declare batch_id: string;

  declare client_id: string;

  /**
   * =====================================================
   * ASIGNACIÓN LOGÍSTICA
   * =====================================================
   */
  declare driver_shift_id: string | null;

  declare driver_user_id: string | null;

  declare vehicle_id: string | null;

  /**
   * =====================================================
   * SNAPSHOT RECEPTOR
   * =====================================================
   *
   * Fotografía histórica de los datos tributarios
   * utilizados al crear el DTE52.
   */
  declare receiver_rut: string;

  declare receiver_name: string;

  declare receiver_activity: string | null;

  /**
   * =====================================================
   * SNAPSHOT TRANSPORTE / DESTINO
   * =====================================================
   */
  declare driver_rut: string | null;

  declare driver_name: string | null;

  declare vehicle_plate: string | null;

  declare carrier_rut: string | null;

  declare destination_address: string;

  declare destination_commune: string;

  declare destination_city: string | null;

  /**
   * =====================================================
   * CONFIGURACIÓN DTE52
   * =====================================================
   *
   * Se persiste para que un reintento genere exactamente
   * el mismo payload utilizado originalmente.
   */
  declare transfer_indicator: number;

  declare dispatch_type: number | null;

  declare departure_date: string;

  declare departure_time: string;

  declare arrival_date: string;

  /**
   * =====================================================
   * MOTOR DE FACTURACIÓN
   * =====================================================
   */
  declare engine_document_id: string | null;

  declare engine_status: string | null;

  declare engine_folio: number | null;

  declare engine_track_id: string | null;

  declare engine_error: string | null;

  /**
   * =====================================================
   * ESTADO TL
   * =====================================================
   *
   * pending
   * processing
   * accepted
   * error
   */
  declare status: CreationOptional<string>;

  /**
   * =====================================================
   * AUDITORÍA
   * =====================================================
   */
  declare requested_by: string;

  declare requested_at: CreationOptional<Date>;

  declare processed_at: Date | null;

  declare createdAt: CreationOptional<Date>;

  declare updatedAt: CreationOptional<Date>;
}

export function initDispatchGuideModel(
  sequelize: Sequelize,
): typeof DispatchGuide {
  DispatchGuide.init(
    {
      id: {
        type: DataTypes.UUID,

        defaultValue: DataTypes.UUIDV4,

        primaryKey: true,
      },

      /**
       * =================================================
       * LOTE / CLIENTE
       * =================================================
       */

      batch_id: {
        type: DataTypes.UUID,

        allowNull: true,

        unique: true,
      },

      client_id: {
        type: DataTypes.UUID,

        allowNull: true,
      },

      /**
       * =================================================
       * LOGÍSTICA
       * =================================================
       */

      driver_shift_id: {
        type: DataTypes.UUID,

        allowNull: true,
      },

      driver_user_id: {
        type: DataTypes.UUID,

        allowNull: true,
      },

      vehicle_id: {
        type: DataTypes.UUID,

        allowNull: true,
      },

      /**
       * =================================================
       * SNAPSHOT RECEPTOR
       * =================================================
       */

      receiver_rut: {
        type: DataTypes.STRING(20),

        allowNull: true,
      },

      receiver_name: {
        type: DataTypes.STRING(200),

        allowNull: true,
      },

      receiver_activity: {
        type: DataTypes.STRING(250),

        allowNull: true,
      },

      /**
       * =================================================
       * SNAPSHOT TRANSPORTE / DESTINO
       * =================================================
       */

      driver_rut: {
        type: DataTypes.STRING(20),

        allowNull: true,
      },

      driver_name: {
        type: DataTypes.STRING(150),

        allowNull: true,
      },

      vehicle_plate: {
        type: DataTypes.STRING(20),

        allowNull: true,
      },

      carrier_rut: {
        type: DataTypes.STRING(20),

        allowNull: true,
      },

      destination_address: {
        type: DataTypes.TEXT,

        allowNull: true,
      },

      destination_commune: {
        type: DataTypes.STRING(100),

        allowNull: true,
      },

      destination_city: {
        type: DataTypes.STRING(100),

        allowNull: true,
      },

      /**
       * =================================================
       * CONFIGURACIÓN DTE52
       * =================================================
       */

      transfer_indicator: {
        type: DataTypes.INTEGER,

        allowNull: true,
      },

      dispatch_type: {
        type: DataTypes.INTEGER,

        allowNull: true,
      },

      departure_date: {
        type: DataTypes.STRING(10),

        allowNull: true,
      },

      departure_time: {
        type: DataTypes.STRING(5),

        allowNull: true,
      },

      arrival_date: {
        type: DataTypes.STRING(10),

        allowNull: true,
      },

      /**
       * =================================================
       * MOTOR
       * =================================================
       */

      engine_document_id: {
        type: DataTypes.STRING(100),

        allowNull: true,
      },

      engine_status: {
        type: DataTypes.STRING(50),

        allowNull: true,
      },

      engine_folio: {
        type: DataTypes.INTEGER,

        allowNull: true,
      },

      engine_track_id: {
        type: DataTypes.STRING(150),

        allowNull: true,
      },

      engine_error: {
        type: DataTypes.TEXT,

        allowNull: true,
      },

      /**
       * =================================================
       * ESTADO TL
       * =================================================
       */

      status: {
        type: DataTypes.STRING(30),

        allowNull: true,

        defaultValue: "pending",
      },

      /**
       * =================================================
       * AUDITORÍA
       * =================================================
       */

      requested_by: {
        type: DataTypes.UUID,

        allowNull: true,
      },

      requested_at: {
        type: DataTypes.DATE,

        allowNull: true,

        defaultValue: DataTypes.NOW,
      },

      processed_at: {
        type: DataTypes.DATE,

        allowNull: true,
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

      tableName: "dispatch_guides",

      timestamps: true,

      underscored: true,

      indexes: [
        {
          unique: true,

          fields: ["batch_id"],
        },

        {
          fields: ["client_id"],
        },

        {
          fields: ["driver_shift_id"],
        },

        {
          fields: ["driver_user_id"],
        },

        {
          fields: ["vehicle_id"],
        },

        {
          fields: ["status"],
        },

        {
          fields: ["engine_document_id"],
        },
      ],
    },
  );

  return DispatchGuide;
}
