import { ApiProperty } from '@nestjs/swagger';

/**
 * Response body for `DELETE /<resource>/:id` endpoints.
 *
 * api-spec.md does not describe a body for DELETE; returning `id` lets the
 * frontend know for certain which record was just deleted (especially when
 * deleting from a list view).
 */
export class DeleteResponseDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: true })
  deleted: boolean;
}
