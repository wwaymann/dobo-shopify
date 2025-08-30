// pages/api/plants.js

export default function handler(req, res) {
  res.status(200).json([
    {
      id: "plant1",
      name: "Succulent",
      image: "/images/plant1.jpg",
    },
    {
      id: "plant2",
      name: "Fern",
      image: "/images/plant2.jpg",
    },
  ]);
}
