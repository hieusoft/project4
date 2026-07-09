import { PaginationDto } from '../dto/pagination.dto';
export function getPagination(dto: PaginationDto): { take: number; skip: number } { return { take: dto.limit, skip: (dto.page - 1) * dto.limit }; }
