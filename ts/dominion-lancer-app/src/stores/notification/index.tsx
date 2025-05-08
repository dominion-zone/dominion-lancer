import { ToasterStore } from 'terracotta';
import { ANotification } from './abstract';

export * from './abstract';
export * from './Error';
export * from './TransactionSuccess';


export const notifications = new ToasterStore<ANotification>();
