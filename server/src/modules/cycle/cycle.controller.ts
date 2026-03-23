// Barrel file — re-exports split controllers as a single CycleController
// so existing imports (routes, index.ts) continue to work unchanged.

import { CycleActionsController } from './cycle-actions.controller';
import { CycleCrudController } from './cycle-crud.controller';

export const CycleController = {
  // CRUD
  getAll: CycleCrudController.getAll,
  getById: CycleCrudController.getById,
  create: CycleCrudController.create,
  addKocs: CycleCrudController.addKocs,
  update: CycleCrudController.update,
  delete: CycleCrudController.delete,
  getExchangeRate: CycleCrudController.getExchangeRate,

  // Actions
  lock: CycleActionsController.lock,
  reopen: CycleActionsController.reopen,
  complete: CycleActionsController.complete,
  scrapeRevenue: CycleActionsController.scrapeRevenue,
  checkPubCodes: CycleActionsController.checkPubCodes,
};
