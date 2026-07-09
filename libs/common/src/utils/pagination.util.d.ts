import { PaginationDto } from '../dto/pagination.dto';
export declare function getPagination(dto: PaginationDto): {
    take: number;
    skip: number;
};
