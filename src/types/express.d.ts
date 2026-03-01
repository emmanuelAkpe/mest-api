import { IAdmin } from '../models/Admin.model';

declare global {
  namespace Express {
    interface Request {
      admin?: IAdmin;
    }
  }
}
