import React from "react"
import { Link, graphql } from "gatsby"
import Layout from "../components/layout"
import SEO from "../components/seo"

//import styled from "@emotion/styled"
import { css } from "@emotion/core"

const BlogLink = css`
  color: black;
  text-decoration: none;
  `

const BlogPage = ({ data }) => {
  console.log(data)
  return (
  <Layout>
    <SEO title="Blog" />
    <div>
        <h4>{data.allMarkdownRemark.totalCount} Posts</h4>
        {data.allMarkdownRemark.edges.map(({ node }) => (
          <div key={node.id}>
            <Link
              to={node.fields.slug}
              css={BlogLink}
            >
              <h3>
                {node.frontmatter.title}{" "}
                <span
                >
                  — {node.frontmatter.date}
                </span>
              </h3>
            <p>{node.excerpt}</p>
            </Link>
          </div>
        ))}
      </div>
  </Layout>
  )
}

export const query = graphql`
  query {
    allMarkdownRemark(sort: { fields: [frontmatter___date], order: DESC }) {
      totalCount
      edges {
        node {
          id
          frontmatter {
            title
            date(formatString: "DD MMMM, YYYY")
          }
          fields {
            slug
          }
          excerpt
        }
      }
    }
  }
`

export default BlogPage
