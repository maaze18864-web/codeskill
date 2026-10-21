export interface TeamMember {
  name: string;
  role: string;
  image: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
}

export const team: readonly TeamMember[] = [
  {
    name: "Venkatesh K",
    role: "Technical Trainer | Ex-Oracle",
    image: "/images/skill-development/team/member-01.jpg",
    linkedin: "https://www.linkedin.com/in/venkatesh-k-20b610109/",
    github: "https://github.com/VenkateshW22",
  },
  { name: "Mustakim", role: "Technical Trainer", image: "/images/skill-development/team/member-02.jpg" },
  { name: "Vishal", role: "Technical Trainer", image: "/images/skill-development/team/member-03.jpg" },
  { name: "Neeraj", role: "Assistant Professor", image: "/images/skill-development/team/member-04.jpg" },
  {
    name: "Md Shadab Azam Ansari",
    role: "Technical Trainer | DevOps & Cloud Engineering",
    image: "/images/skill-development/team/member-05.jpg",
    linkedin: "https://linkedin.com/in/sazamansari",
    github: "https://github.com/sazamansari",
    portfolio: "https://md-shadab-azam-ansari.vercel.app",
  },
  { name: "Tushar", role: "Technical Trainer", image: "/images/skill-development/team/member-06.jpg" },
  { name: "Mazz", role: "Technical Trainer", image: "/images/skill-development/team/member-07.jpg" },
  { name: "Anmol", role: "Technical Trainer", image: "/images/skill-development/team/member-08.jpg" },
  { name: "Abhinav", role: "Technical Trainer", image: "/images/skill-development/team/member-09.jpg" },
];
