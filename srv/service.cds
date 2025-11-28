using { my.app as db } from '../db/schema';

service PersonService {
  entity People as projection on db.Person;
}