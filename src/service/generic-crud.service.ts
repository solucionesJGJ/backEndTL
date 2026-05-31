import {
    type Model,
    type ModelStatic,
    type FindOptions,
    type CreateOptions,
    type UpdateOptions,
    type DestroyOptions,
    type WhereOptions,
} from "sequelize";

export class GenericCrudService<T extends Model> {
    constructor(private readonly model: ModelStatic<T>) { }

    async findAll(options: FindOptions = {}): Promise<T[]> {
        return this.model.findAll(options);
    }

    async findById(id: string, options: FindOptions = {}): Promise<T | null> {
        return this.model.findByPk(id, options);
    }

    async create(data: object, options: CreateOptions = {}): Promise<T> {
        return this.model.create(data as any, options);
    }

    async updateById(
        id: string,
        data: object,
        options: UpdateOptions = { where: {} }
    ): Promise<T | null> {
        const record = await this.model.findByPk(id);

        if (!record) {
            return null;
        }

        await record.update(data as any, options);

        return record;
    }

    async deleteById(
        id: string,
        options: DestroyOptions = {}
    ): Promise<boolean> {
        const deletedCount = await this.model.destroy({
            ...options,
            where: {
                id,
                ...(options.where as object),
            } as WhereOptions,
        });

        return deletedCount > 0;
    }

    async softDeleteById(id: string): Promise<T | null> {
        const record = await this.model.findByPk(id);

        if (!record) {
            return null;
        }

        await record.update({ active: false } as any);

        return record;
    }
}