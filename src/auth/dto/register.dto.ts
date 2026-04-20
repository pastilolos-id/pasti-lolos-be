import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  // MaxLength,
  Equals,
  Matches,
  IsBoolean,
} from 'class-validator';
import { Match } from 'src/common/decorators/match.decorator';

export class RegisterDto {
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty({ message: 'Email tidak boleh kosong' })
  email!: string;

  // @IsString()
  // @IsNotEmpty({ message: 'Username tidak boleh kosong' })
  // @MinLength(3, { message: 'Username minimal 3 karakter' })
  // @MaxLength(20, { message: 'Username maksimal 20 karakter' })
  // username: string;
  @IsBoolean()
  @IsNotEmpty()
  @Equals(true, { message: 'Anda harus menyetujui syarat dan ketentuan' })
  isAgreed!: boolean;

  @IsString()
  @IsNotEmpty({ message: 'Nama lengkap tidak boleh kosong' })
  @MinLength(3, { message: 'Nama minimal 3 karakter' })
  fullName: string;
  // Method helper untuk memisahkan nama
  splitName() {
    const names = this.fullName.trim().split(' ');
    const firstName = names[0];
    const lastName = names.length > 1 ? names.slice(1).join(' ') : '';
    return { firstName, lastName };
  }

  @IsString()
  @IsNotEmpty({ message: 'Password tidak boleh kosong' })
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  password: string;

  @IsString()
  @Match('password', { message: 'Konfirmasi password tidak cocok!' })
  confirmPassword: string;

  @IsString()
  @IsNotEmpty({ message: 'Nomor HP tidak boleh kosong' })
  @Matches(/^08[0-9]{8,11}$/, {
    message: 'Nomor HP harus diawali 08 dan terdiri dari 10-13 digit',
  })
  phoneNumber: string;
}
