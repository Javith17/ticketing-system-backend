import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from './pagination.dto';

export class CreateNcrTicketDto {
  // uuid of the tickets row this NCR is raised against (tickets.id).
  @IsUUID()
  @IsNotEmpty()
  ticket_id: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  // Only used when a super admin (ADMIN) raises the NCR from the web app:
  // the technician (users.id) it is raised on behalf of. Required for ADMIN,
  // ignored for a TECHNICIAN (their NCR is always raised as themselves).
  @IsUUID()
  @IsOptional()
  raised_by?: string;
}

export class NcrTicketListDto extends PaginationDto {
  @IsString()
  @IsOptional()
  status?: string;
}

export class QualityReviewDto {
  @IsString()
  @IsNotEmpty()
  review_remarks: string;
}

export class NcrApprovalActionDto {
  @IsString()
  @IsOptional()
  approval_remarks?: string;
}

export class NcrClosureRemarksDto {
  @IsString()
  @IsNotEmpty()
  closure_remarks: string;
}
