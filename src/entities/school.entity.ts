import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';

@Entity('schools')
export class School {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  domain: string;

  @Column('geometry', {
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location: string; // POINT(long lat)

  @Column('timestamptz', { default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}

// CREATE TABLE schools (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   name TEXT NOT NULL,
//   domain TEXT NOT NULL UNIQUE,
//   location GEOMETRY(Point, 4326) NOT NULL,
//   created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
// );
