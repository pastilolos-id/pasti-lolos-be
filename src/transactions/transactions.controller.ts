import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorators';
import { TransactionsService } from './transactions.service';
import { GetTransactionsDto } from './dto/get-transactions.dto';

@ApiTags('Transactions')
@ApiCookieAuth()
@Controller('transactions')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get('summary')
  @Roles('2', '3')
  @ApiOperation({
    summary: 'Admin: Ringkasan transaksi (total, sukses, pending)',
  })
  getSummary() {
    return this.transactionsService.getTransactionSummary();
  }

  @Get()
  @Roles('2', '3')
  @ApiOperation({
    summary:
      'Admin: List semua transaksi. Filter: type (question_bank|exam|course), status (pending|paid|failed), search, page, limit',
  })
  getAll(@Query() query: GetTransactionsDto) {
    return this.transactionsService.getTransactions({
      type: query.type,
      status: query.status,
      search: query.search,
      page: query.page ? +query.page : 1,
      limit: query.limit ? +query.limit : 10,
    });
  }
  @Get(':id')
  @Roles('2', '3')
  @ApiOperation({
    summary: 'Admin: Lihat detail satu transaksi berdasarkan Order ID',
  })
  getDetail(@Param('id', ParseIntPipe) id: number) {
    return this.transactionsService.getTransactionDetail(id);
  }
}
