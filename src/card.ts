import { SCARDHANDLE } from './types.ts';
import { Context } from "./context.ts";

export class Card {
  constructor( public context: Context, public handle: SCARDHANDLE, public protocol: number ) {

  }
}